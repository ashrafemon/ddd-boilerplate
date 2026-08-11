import { Injectable } from '@nestjs/common';
import { Counter, Gauge, Histogram, Registry, collectDefaultMetrics } from 'prom-client';
import { CounterOptions, GaugeOptions, HistogramOptions, MetricsPort } from '../../shared-kernel/ports/observability/metrics.port';

/**
 * Prometheus-backed metrics adapter. Metrics are exposed by the platform
 * health/observability controller at the configured path.
 */
@Injectable()
export class PrometheusMetricsAdapter implements MetricsPort {
  private readonly registry = new Registry();
  private readonly counters = new Map<string, Counter<string>>();
  private readonly histograms = new Map<string, Histogram<string>>();
  private readonly gauges = new Map<string, Gauge<string>>();

  constructor() {
    this.registry.setDefaultLabels({ app: 'erp-api' });
    collectDefaultMetrics({ register: this.registry, prefix: 'erp_' });
  }

  public getRegistry(): Registry {
    return this.registry;
  }

  public async getMetricsContentType(): Promise<string> {
    return this.registry.contentType;
  }

  public async getMetrics(): Promise<string> {
    return this.registry.metrics();
  }

  public registerCounter(options: CounterOptions): void {
    if (!this.counters.has(options.name)) {
      const counter = new Counter({
        name: options.name,
        help: options.help,
        labelNames: options.labelNames ?? [],
        registers: [this.registry],
      });
      this.counters.set(options.name, counter);
    }
  }

  public registerHistogram(options: HistogramOptions): void {
    if (!this.histograms.has(options.name)) {
      const histogram = new Histogram({
        name: options.name,
        help: options.help,
        labelNames: options.labelNames ?? [],
        buckets: options.buckets,
        registers: [this.registry],
      });
      this.histograms.set(options.name, histogram);
    }
  }

  public registerGauge(options: GaugeOptions): void {
    if (!this.gauges.has(options.name)) {
      const gauge = new Gauge({
        name: options.name,
        help: options.help,
        labelNames: options.labelNames ?? [],
        registers: [this.registry],
      });
      this.gauges.set(options.name, gauge);
    }
  }

  public incrementCounter(name: string, labels?: Record<string, string>, value = 1): void {
    const counter = this.counters.get(name);
    if (counter) {
      counter.inc(labels ?? {}, value);
    }
  }

  public observeHistogram(name: string, value: number, labels?: Record<string, string>): void {
    const histogram = this.histograms.get(name);
    if (histogram) {
      histogram.observe(labels ?? {}, value);
    }
  }

  public setGauge(name: string, value: number, labels?: Record<string, string>): void {
    const gauge = this.gauges.get(name);
    if (gauge) {
      gauge.set(labels ?? {}, value);
    }
  }
}
