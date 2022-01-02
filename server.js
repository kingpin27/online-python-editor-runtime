const { WebSocketServer } = require('ws');
const { exec } = require('child_process');
const temporary = require('temporary')
const fs = require("fs").promises;

const port = process.env.PORT || 8080;
const wss = new WebSocketServer({ port });

wss.on('connection', function connection(ws) {
    let prcs = null
    ws.on('message', async function incoming(message) {
        try {
            const req = JSON.parse(message)
            switch (req.type) {
                case "exit":
                    prcs.kill()
                    break
                case "run":
                    if (prcs) {
                        prcs.kill()
                    }
                    const file = new temporary.File()
                    await fs.writeFile(file.path, req.value)
                    prcs = exec(`python3 ${file.path}`, { timeout: 20000 })
                    prcs.stderr.on('data', (chunk) => {
                        ws.send(JSON.stringify({
                            type: "stderr",
                            data: chunk.toString()
                        }))
                    })
                    prcs.stdout.on('data', (chunk) => {
                        ws.send(JSON.stringify({
                            type: "data",
                            data: chunk.toString()
                        }))
                    })
                    prcs.on('exit', (code, signal) => {
                        prcs = null
                        file.unlinkSync()
                        ws.send(JSON.stringify({
                            type: "exit",
                            code
                        }))
                    })
                    break
                case "input":
                    if (prcs) {
                        prcs.stdin.write(req.value + '\n')
                        ws.send(JSON.stringify({
                            type: "data",
                            data: req.val
                        }))
                    }
                    else {
                        ws.send(JSON.stringify({
                            type: "runtime_error",
                            message: "no process running"
                        }))
                    }
                    break
                default:
                    break
            }
        } catch (error) {
            console.error(error)
            ws.send(JSON.stringify({
                type: "runtime_error"
            }))
        }
    });
});