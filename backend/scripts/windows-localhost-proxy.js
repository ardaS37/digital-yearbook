const net = require('net');

const listenHost = process.env.PROXY_LISTEN_HOST || '127.0.0.1';
const listenPort = Number(process.env.PROXY_LISTEN_PORT || 3000);
const targetHost = process.env.PROXY_TARGET_HOST || '172.25.190.78';
const targetPort = Number(process.env.PROXY_TARGET_PORT || 3000);

const server = net.createServer((client) => {
  const upstream = net.connect(targetPort, targetHost);

  client.pipe(upstream);
  upstream.pipe(client);

  client.on('error', () => {});
  upstream.on('error', () => client.destroy());
});

server.listen(listenPort, listenHost, () => {
  console.log(`Windows proxy listening on ${listenHost}:${listenPort} -> ${targetHost}:${targetPort}`);
});
