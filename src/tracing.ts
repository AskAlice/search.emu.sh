import { DiagConsoleLogger, DiagLogLevel, diag } from '@opentelemetry/api';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { AsyncLocalStorageContextManager } from '@opentelemetry/context-async-hooks';
import { CompositePropagator, W3CBaggagePropagator, W3CTraceContextPropagator } from '@opentelemetry/core';
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-grpc';
import { PrometheusExporter } from '@opentelemetry/exporter-prometheus';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-grpc';
import { HttpInstrumentation } from '@opentelemetry/instrumentation-http';
import { B3InjectEncoding, B3Propagator } from '@opentelemetry/propagator-b3';
import { Resource } from '@opentelemetry/resources';
import { NodeSDK } from '@opentelemetry/sdk-node';
import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions';
// For troubleshooting, set the log level to DiagLogLevel.DEBUG



const otelLogLevel = process.env?.OTEL_DEBUG === 'true' ? diag.setLogger(new DiagConsoleLogger(), DiagLogLevel.DEBUG) : DiagLogLevel.INFO || DiagLogLevel.INFO;

const collectorOptions = {
    url: 'grpc://127.0.0.1:4317',

};
const metricCollectorOptions = {
    url: 'grpc://127.0.0.1:4317',
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
    

    // metricExporter: metricExporter,
    contextManager: new AsyncLocalStorageContextManager(),
    resource: new Resource({
        [SemanticResourceAttributes.SERVICE_NAME]: 'search',
        [SemanticResourceAttributes.SERVICE_VERSION]: '0.0.0',
    }),
    traceExporter: exporter,
    metricReader: prometheusExp,
    textMapPropagator: new CompositePropagator({
        propagators: [
            new W3CTraceContextPropagator(),
            new W3CBaggagePropagator(),
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
// package main

// import (
// 	"context"
// 	"log"
// 	"os"
// 	"os/signal"
// 	"syscall"

// 	"go.opentelemetry.io/otel"
// 	"go.opentelemetry.io/otel/exporters/prometheus"
// 	"go.opentelemetry.io/otel/exporters/trace/jaeger"
// 	"go.opentelemetry.io/otel/propagation"
// 	"go.opentelemetry.io/otel/sdk/resource"
// 	sdktrace "go.opentelemetry.io/otel/sdk/trace"
// 	"go.opentelemetry.io/otel/semconv/v1.4.0"
// 	"go.opentelemetry.io/otel/trace"
// )

// func main() {
// 	// Create and configure a new Prometheus exporter
// 	promExporter, err := prometheus.New(prometheus.Config{})
// 	if err != nil {
// 		log.Fatalf("failed to initialize prometheus exporter: %v", err)
// 	}

// 	// Create and configure a new Jaeger exporter
// 	jaegerExporter, err := jaeger.New(jaeger.WithCollectorEndpoint(jaeger.WithEndpoint("http://jaeger:14250")))
// 	if err != nil {
// 		log.Fatalf("failed to initialize jaeger exporter: %v", err)
// 	}

// 	// Create a new tracer provider with the exporters
// 	tp := sdktrace.NewTracerProvider(
// 		sdktrace.WithBatcher(jaegerExporter),
// 		sdktrace.WithResource(resource.NewWithAttributes(
// 			semconv.SchemaURL,
// 			semconv.ServiceNameKey.String("search"),
// 			semconv.ServiceVersionKey.String("0.0.0"),
// 		)),
// 	)

// 	// Set the global tracer provider and propagator
// 	otel.SetTracerProvider(tp)
// 	otel.SetTextMapPropagator(propagation.NewCompositeTextMapPropagator(
// 		propagation.TraceContext{},
// 		propagation.Baggage{},
// 	))

// 	// Handle shutdown gracefully
// 	ctx, cancel := context.WithCancel(context.Background())
// 	defer cancel()

// 	sigCh := make(chan os.Signal, 1)
// 	signal.Notify(sigCh, syscall.SIGINT, syscall.SIGTERM)
// 	go func() {
// 		<-sigCh
// 		if err := tp.Shutdown(ctx); err != nil {
// 			log.Fatalf("failed to shutdown tracer provider: %v", err)
// 		}
// 		cancel()
// 	}()

// 	// Your application code here

// 	<-ctx.Done()
// }
