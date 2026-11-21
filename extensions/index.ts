import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";

const STATE_TYPE = "approval-loop-state";
const DEFAULT_MESSAGE = "Approved. Keep going.";
const DEFAULT_DELAY_MS = 1_000;

type ApprovalLoopState = {
	active: boolean;
	message: string;
};

export default function approvalLoop(pi: ExtensionAPI) {
	let state: ApprovalLoopState = { active: false, message: DEFAULT_MESSAGE };
	let timer: ReturnType<typeof setTimeout> | undefined;

	function clearTimer() {
		if (timer) clearTimeout(timer);
		timer = undefined;
	}

	function persist() {
		pi.appendEntry(STATE_TYPE, state);
	}

	function restore(ctx: ExtensionContext) {
		state = { active: false, message: DEFAULT_MESSAGE };
		for (const entry of ctx.sessionManager.getBranch()) {
			if (entry.type !== "custom" || entry.customType !== STATE_TYPE) continue;
			const saved = entry.data as Partial<ApprovalLoopState> | undefined;
			state = {
				active: saved?.active === true,
				message: typeof saved?.message === "string" && saved.message.trim() ? saved.message : DEFAULT_MESSAGE,
			};
		}
	}

	function updateStatus(ctx: ExtensionContext) {
		ctx.ui.setStatus("approval-loop", state.active ? `Auto approval: ${state.message}` : undefined);
	}

	function schedule(delayMs = DEFAULT_DELAY_MS) {
		clearTimer();
		if (!state.active) return;
		timer = setTimeout(() => {
			timer = undefined;
			if (state.active) pi.sendUserMessage(state.message);
		}, delayMs);
	}

	pi.registerCommand("approve-loop", {
		description: "Repeat a short approval message after every model response: start [message] | stop | status",
		handler: async (args, ctx) => {
			const trimmed = args.trim();
			const [command = "status", ...rest] = trimmed.split(/\s+/);

			if (command === "start") {
				state.active = true;
				state.message = rest.join(" ").trim() || DEFAULT_MESSAGE;
				persist();
				updateStatus(ctx);
				ctx.ui.notify(`Approval loop started: ${state.message}`, "info");
				schedule(0);
				return;
			}

			if (command === "stop") {
				state.active = false;
				clearTimer();
				persist();
				updateStatus(ctx);
				ctx.ui.notify("Approval loop stopped.", "info");
				return;
			}

			if (command === "status") {
				ctx.ui.notify(
					state.active ? `Approval loop is active: ${state.message}` : "Approval loop is stopped.",
					"info",
				);
				return;
			}

			ctx.ui.notify("Usage: /approve-loop start [message] | stop | status", "error");
		},
	});

	pi.on("session_start", async (_event, ctx) => {
		clearTimer();
		restore(ctx);
		updateStatus(ctx);
		if (state.active) {
			ctx.ui.notify(`Approval loop resuming: ${state.message}`, "info");
			schedule();
		}
	});

	pi.on("agent_settled", async (event, ctx) => {
		if (!state.active) return;
		if (event.aborted) {
			state.active = false;
			clearTimer();
			persist();
			updateStatus(ctx);
			ctx.ui.notify("Approval loop paused because the turn was aborted.", "warning");
			return;
		}
		schedule();
	});

	pi.on("session_shutdown", async () => {
		clearTimer();
	});
}
