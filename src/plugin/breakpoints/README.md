# Steps to enable the breakpoint service again:

This service has been disabled for now, as it is not used.
It is kept here until VSCode extends the breakpoints API.

- package.json

```json
    "commands": [
      {
          "command": "memory-inspector.data-breakpoint.set.read",
          "title": "Break on Value Read",
          "enablement": "memory-inspector.canWrite",
          "category": "Memory"
      },
      {
          "command": "memory-inspector.data-breakpoint.set.readWrite",
          "title": "Break on Value Access",
          "enablement": "memory-inspector.canWrite",
          "category": "Memory"
      },
      {
          "command": "memory-inspector.data-breakpoint.set.write",
          "title": "Break on Value Change",
          "enablement": "memory-inspector.canWrite",
          "category": "Memory"
      },
      {
        "command": "memory-inspector.data-breakpoint.remove",
        "title": "Remove Breakpoint",
        "enablement": "memory-inspector.canWrite",
        "category": "Memory"
      },
      {
        "command": "memory-inspector.data-breakpoint.remove-all",
        "title": "Remove All Breakpoints",
        "enablement": "memory-inspector.canWrite",
        "category": "Memory"
      },
    ]

      "webview/context": [
        ...
        {
          "command": "memory-inspector.data-breakpoint.set.read",
          "group": "breakpoints@1",
          "when": "false && webviewId === memory-inspector.memory && memory-inspector.breakpoint.isBreakable"
        },
        {
          "command": "memory-inspector.data-breakpoint.set.write",
          "group": "breakpoints@2",
          "when": "false && webviewId === memory-inspector.memory && memory-inspector.breakpoint.isBreakable"
        },
        {
          "command": "memory-inspector.data-breakpoint.set.readWrite",
          "group": "breakpoints@3",
          "when": "false && webviewId === memory-inspector.memory && memory-inspector.breakpoint.isBreakable"
        },
        {
          "command": "memory-inspector.data-breakpoint.remove",
          "group": "breakpoints@4",
          "when": "false && webviewId === memory-inspector.memory && memory-inspector.breakpoint.type === 'internal'"
        },
        {
          "command": "memory-inspector.data-breakpoint.remove-all",
          "group": "breakpoints@5",
          "when": "false && webviewId === memory-inspector.memory && memory-inspector.breakpoint.type === 'internal'"
        }
      ]
```
