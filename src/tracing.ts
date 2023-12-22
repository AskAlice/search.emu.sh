import { DiagConsoleLogger, DiagLogLevel, diag } from '@opentelemetry/api';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { AsyncLocalStorageContextManager } from '@opentelemetry/context-async-hooks';
import { CompositePropagator, HttpBaggagePropagator, HttpTraceContextPropagator } from '@opentelemetry/core';
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-grpc';
import { PrometheusExporter } from '@opentelemetry/exporter-prometheus';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-grpc';
import { FastifyInstrumentation } from '@opentelemetry/instrumentation-fastify';
import { HttpInstrumentation } from '@opentelemetry/instrumentation-http';
import { B3InjectEncoding, B3Propagator } from '@opentelemetry/propagator-b3';
import { Resource } from '@opentelemetry/resources';
import { MeterProvider, PeriodicExportingMetricReader } from '@opentelemetry/sdk-metrics';
import { NodeSDK } from '@opentelemetry/sdk-node';
import { BasicTracerProvider, BatchSpanProcessor } from '@opentelemetry/sdk-trace-base';
import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions';
// For troubleshooting, set the log level to DiagLogLevel.DEBUG

const otelLogLevel = process.env?.OTEL_DEBUG === 'true' ? diag.setLogger(new DiagConsoleLogger(), DiagLogLevel.DEBUG) : DiagLogLevel.INFO || DiagLogLevel.INFO;

const collectorOptions = {
    url: 'grpc://localhost:4317',

};
const metricCollectorOptions = {
    url: 'grpc://0.0.0.0:4317',
};

const metricExporter = new OTLPMetricExporter();
// const meterProvider = new MeterProvider({});
// const provider = new BasicTracerProvider();
const exporter = new OTLPTraceExporter();
// provider.addSpanProcessor(new BatchSpanProcessor(exporter, {
//   // The maximum queue size. After the size is reached spans are dropped.
//   maxQueueSize: 100,
//   // The maximum batch size of every export. It must be smaller or equal to maxQueueSize.
//   maxExportBatchSize: 10,
//   // The interval between two consecutive exports
//   scheduledDelayMillis: 500,
//   // How long the export can run before it is cancelled
//   exportTimeoutMillis: 30000,
// }));

// provider.register();

// provider.addSpanProcessor(new BatchSpanProcessor(exporter));
// meterProvider.addMetricReader(new PeriodicExportingMetricReader({
//   exporter: metricExporter,
//   exportIntervalMillis: 1000,
// }));

// opentelemetry.metrics.setGlobalMeterProvider(meterProvider);
const prometheusExp = new PrometheusExporter({ port: 9462 });
// record a metric event.
const http = new HttpInstrumentation();
const otelSDK = new NodeSDK({
    serviceName: 'search',
    spanProcessor: new BatchSpanProcessor(exporter),
    // metricExporter: metricExporter,
    contextManager: new AsyncLocalStorageContextManager(),
    resource: new Resource({
        [SemanticResourceAttributes.SERVICE_NAME]: 'search',
        [SemanticResourceAttributes.SERVICE_VERSION]: '0.0.0',
    }),

    textMapPropagator: new CompositePropagator({
        propagators: [
            new HttpTraceContextPropagator(),
            new HttpBaggagePropagator(),
            new B3Propagator({
                injectEncoding: B3InjectEncoding.MULTI_HEADER,
            }),
        ],
    }),
    instrumentations: [
        getNodeAutoInstrumentations({
            // load custom configuration for http instrumentation
            '@opentelemetry/instrumentation-http': {
                applyCustomAttributesOnSpan: (span) => {

                },
            },
        }),

    ],
});
// You can also use the shutdown method to gracefully shut down the SDK before process shutdown
// or on some operating system signal.

export default otelSDK;
