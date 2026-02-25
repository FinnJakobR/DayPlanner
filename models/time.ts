import { cappedDiff } from "../util/utility.js";

export function sameTime(a: Time, b: Time): boolean {
  return a.hour == b.hour && a.minute == b.minute && a.second == b.second;
}

export function inSeconds(a: Time): number {
  return a.hour * 3600 + a.minute * 60 + a.second;
}

export function inMinutes(a: Time): number {
  return a.hour * 60 + a.minute + a.second / 60;
}

export function inHours(a: Time): number {
  return a.hour + a.minute / 60 + a.second / 3600;
}

export function isBefore(a: Time, b: Time): boolean {
  return inSeconds(a) < inSeconds(b);
}

export function isAfter(a: Time, b: Time): boolean {
  return !isBefore(a, b);
}

export function normalizeTime(t: Time): number {
  return (
    (inSeconds(t) - inSeconds(DAY_START_TIME)) /
    (inSeconds(DAY_END_TIME) - inSeconds(DAY_START_TIME))
  );
}

export class Timing {
  public hour: number = 0;
  public minute: number = 0;
  public second: number = 0;

  constructor({
    hour = 0,
    minute = 0,
    second = 0,
  }: {
    hour?: number;
    minute?: number;
    second?: number;
  }) {
    this.hour = hour;
    this.minute = minute;
    this.second = second;
  }

  static fromHours(time: number) {
    const hours = Math.floor(time);
    const minutes = Math.floor((time - hours) * 60);
    const seconds = Math.floor(((time - hours) * 60 - minutes) * 60);

    const timeObj = new Time({ hour: hours, minute: minutes, second: seconds });

    return timeObj;
  }

  static diff(a: Timing, b: Timing): Timing {
    const aSeconds = a.hour * 3600 + a.minute * 60 + a.second;
    const bSeconds = b.hour * 3600 + b.minute * 60 + b.second;

    let diff = Math.abs(aSeconds - bSeconds);

    const hour = Math.floor(diff / 3600);
    diff %= 3600;

    const minute = Math.floor(diff / 60);
    const second = diff % 60;

    return new Timing({ hour: hour, minute: minute, second: second });
  }

  static add(a: Timing, b: Timing): Timing {
    let totalSeconds =
      a.hour * 3600 +
      a.minute * 60 +
      a.second +
      b.hour * 3600 +
      b.minute * 60 +
      b.second;

    const hour = Math.floor(totalSeconds / 3600);
    totalSeconds %= 3600;

    const minute = Math.floor(totalSeconds / 60);
    const second = totalSeconds % 60;

    return new Timing({ hour, minute, second });
  }
}

export class Time extends Timing {
  constructor({
    hour = 0,
    minute = 0,
    second = 0,
  }: {
    hour?: number;
    minute?: number;
    second?: number;
  }) {
    super({ hour: hour, minute: minute, second: second });
  }
}

export class Duration extends Timing {
  constructor({
    hour = 0,
    minute = 0,
    second = 0,
  }: {
    hour?: number;
    minute?: number;
    second?: number;
  }) {
    super({ hour: hour, minute: minute, second: second });
  }
}

const DAY_START_TIME: Time = new Time({
  hour: 11,
  minute: 30,
  second: 0,
});
const DAY_END_TIME: Time = new Time({ hour: 23, minute: 0, second: 0 });

export { DAY_START_TIME, DAY_END_TIME };
