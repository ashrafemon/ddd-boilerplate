export interface CounterOptions {
  name: string;
  help: string;
  labelNames?: string[];
}

export interface HistogramOptions {
  name: string;
  help: string;
  labelNames?: string[];
  buckets?: number[];
}

export interface GaugeOptions {
  name: string;
  help: string;
  labelNames?: string[];
}

/**
 * Metrics abstraction (Prometheus by default). Business/application code must
 * not depend on prom-client directly.
 */
export abstract class MetricsPort {
  public abstract incrementCounter(
    name: string,
    labels?: Record<string, string>,
    value?: number,
  ): void;
  public abstract observeHistogram(
    name: string,
    value: number,
    labels?: Record<string, string>,
  ): void;
  public abstract setGauge(name: string, value: number, labels?: Record<string, string>): void;
  public abstract registerCounter(options: CounterOptions): void;
  public abstract registerHistogram(options: HistogramOptions): void;
  public abstract registerGauge(options: GaugeOptions): void;
}
