import { Time } from "../models/time.js";

export default class State {
  public current_tasks: number = 0.0;
  public energy: number = 1.0;
  public stress: number = 0.0;
  public remaining_tasks: number = 0.0;
  public delay: number = 0.0;
  public time: Time = new Time({ hour: 0, minute: 0, second: 0 });

  constructor() {}
}
