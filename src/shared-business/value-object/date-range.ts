import { DomainException } from '../../shared-kernel/exceptions/domain.exception';
import { ValueObject } from '../domain/value-object';

interface DateRangeProps {
  start: Date;
  end: Date;
}

/**
 * Inclusive date range value object. `end` must not be before `start`.
 */
export class DateRange extends ValueObject<DateRangeProps> {
  private constructor(start: Date, end: Date) {
    super({ start, end });
  }

  public static from(start: Date, end: Date): DateRange {
    if (end.getTime() < start.getTime()) {
      throw new DomainException('DateRange end must not be before start', 'INVALID_DATE_RANGE');
    }
    return new DateRange(start, end);
  }

  public getStart(): Date {
    return this.props.start;
  }

  public getEnd(): Date {
    return this.props.end;
  }

  public contains(date: Date): boolean {
    return date.getTime() >= this.props.start.getTime() && date.getTime() <= this.props.end.getTime();
  }
}
