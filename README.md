# pi-approval-loop

Pi extension that registers `/approve-loop`. While it is running, it sends a short approval message after every completed model response so an unattended session keeps going.

Default message: `Approved. Keep going.`

## Install

```bash
pi install git:github.com/webdawg/pi-approval-loop
```

Then start Pi, or run `/reload` in an open session.

## Use

```text
/approve-loop start
/approve-loop status
/approve-loop stop
```

Custom message:

```text
/approve-loop start Yes, approved. Continue.
```

Escape during a response pauses the loop so it does not immediately restart.
