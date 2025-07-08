import Fastify from 'fastify';
import app from './app';
const {execSync} = require('child_process')
const fastify = Fastify({
    http2: true,
    logger: true
  })
fastify.register(app);
export default function start(otelSDK){
// dynamic port allocation
const port = Number(process.env.PORT) || Number(execSync('shuf -i 3006-10000 -n 1').toString().trim())
  fastify.log.info(`port: ${port}`)
  fastify.listen({ port: port, host: "0.0.0.0" }, function (err, address) {
    if (err) {
      fastify.log.error(`port ${process.env.PORT} is already in use`)
      fastify.log.error(err)
      otelSDK
    .shutdown()
    .then(
        () => console.log('SDK shut down successfully'),
        (err) => console.log('Error shutting down SDK', err)
        )
        .finally(() => process.exit(0));
      process.exit(1)
    }
    // Server is now listening on ${address}
  })
}