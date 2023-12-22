import Fastify from 'fastify'
const {execSync} = require('child_process')
import app from './app';
const fastify = Fastify({
    http2: true,
    logger: true
  })
fastify.register(app);
export default function start(otelSDK){
fastify.listen({ port: 3006 }, function (err, address) {
    if (err) {
        
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