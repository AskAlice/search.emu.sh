import opentelemetry from '@opentelemetry/api';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { JaegerExporter } from '@opentelemetry/exporter-jaeger';
import { registerInstrumentations } from '@opentelemetry/instrumentation';
import { FastifyInstrumentation } from '@opentelemetry/instrumentation-fastify';
import { HttpInstrumentation } from '@opentelemetry/instrumentation-http';
import { Resource } from '@opentelemetry/resources';
import { BatchSpanProcessor } from '@opentelemetry/sdk-trace-base';
import { NodeTracerProvider } from '@opentelemetry/sdk-trace-node';
import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions';

const create = () => {
  const options = {
    tags: [], // optional
    // You can use the default UDPSender
    host: 'localhost', // optional
    port: 6832, // optional
    // OR you can use the HTTPSender as follows
    // endpoint: 'http://localhost:16686/api/traces',
    maxPacketSize: 65000, // optional
  };
  const jaeger = new JaegerExporter(options);
  const provider = new NodeTracerProvider({
    resource: new Resource({
      [SemanticResourceAttributes.SERVICE_NAME]: 'search',
    }),
  });
  const fastifyInstrumentation = new FastifyInstrumentation();
  registerInstrumentations({
    tracerProvider: provider,
    instrumentations: [
      // Fastify instrumentation expects HTTP layer to be instrumented
      getNodeAutoInstrumentations({
        // load custom configuration for http instrumentation
        '@opentelemetry/instrumentation-http': {
          applyCustomAttributesOnSpan: (span) => {
            span.setAttribute('foo2', 'bar2');
          },
        },
        '@opentelemetry/instrumentation-fastify': {},
      }),
      new HttpInstrumentation(),
      fastifyInstrumentation,
    ],
  });

  //   const exporter = new CollectorTraceExporter();
  //   provider.addSpanProcessor(new SimpleSpanProcessor(exporter));
  //   provider.addSpanProcessor(new BatchSpanProcessor(new ConsoleSpanExporter()));
  provider.addSpanProcessor(new BatchSpanProcessor(jaeger));

  // Initialize the OpenTelemetry APIs to use the NodeTracerProvider bindings
  provider.register({});
  const tracer = opentelemetry.trace.getTracer('search');
  return { tracer, fastifyInstrumentation, provider };
};
let { tracer, fastifyInstrumentation, provider } = create();
export { tracer, fastifyInstrumentation, provider };
