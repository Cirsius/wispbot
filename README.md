## wispbot
lets users add wisp servers to a list in an embed. checks if the server is an actual wisp server before adding, if it isnt, it doesnt add it. rechecks all servers every 24 hours or on startup.

### how it works
uses wisp-js to attempt a connection to the server. if the wisp handshake completes successfully (onopen fires), its valid. if it errors, closes, or times out after 5 seconds, its not valid.

### commands
- !addwisp - adds a wisp server to the list (anyone can use)
- !removewisp - removes a wisp server (owner only)
- !setchannel - sets the channel where the list will be posted (owner only)
- !removechannel - removes the channel where the list is posted (owner only)

### prerequisites
- bun
- discord bot