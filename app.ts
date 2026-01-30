// interfaces
interface IEvent {
  type(): string;
  machineId(): string;
}

interface ISubscriber {
  handle(event: IEvent): void;
}

interface IPublishSubscribeService {
  publish (event: IEvent): void;
  subscribe (type: string, handler: ISubscriber): void;
  unsubscribe (type: string, handler: ISubscriber): void;
}


// implementations
class MachineSaleEvent implements IEvent {
  constructor(private readonly _sold: number, private readonly _machineId: string) {}

  machineId(): string {
    return this._machineId;
  }

  getSoldQuantity(): number {
    return this._sold
  }

  type(): string {
    return 'sale';
  }
}

class MachineRefillEvent implements IEvent {
  constructor(private readonly _refill: number, private readonly _machineId: string) {}

  machineId(): string {
    return this._machineId;
  }

  getRefillQuantity(): number {
    return this._refill;
  }

  type(): string {
    return 'refill';
  }
}

class LowStockWarningEvent implements IEvent {
  constructor(private readonly _quantity: number, private readonly _machineId: string) {}

  machineId(): string {
    return this._machineId;
  }

  getCurrQuantity(): number {
    return this._quantity;
  }

  type(): string {
    return 'Low Stock Warning';
  }
}

class StockLevelOkEvent implements IEvent {
  constructor(private readonly _quantity: number, private readonly _machineId: string) {}

  machineId(): string {
    return this._machineId;
  }

  getCurrQuantity(): number {
    return this._quantity;
  }

  type(): string {
    return 'Stock OK';
  }
}

class EmptyStockEvent implements IEvent {
  constructor(private readonly _quantity: number, private readonly _machineId: string) {}

  machineId(): string {
    return this._machineId;
  }

  getCurrQuantity(): number {
    return 0;
  }

  type(): string {
    return 'Empty Stock';
  }
}

class MachineSaleSubscriber implements ISubscriber {
  public machines: Machine[];
  public pubSub: IPublishSubscribeService

  constructor (machines: Machine[], pubSub: IPublishSubscribeService) {
    this.machines = machines;
    this.pubSub = pubSub;
  }

  handle(event: MachineSaleEvent): void {
    let i = 0;
    while (i < this.machines.length && this.machines[i].id !== event.machineId()) i++;
    let machine = this.machines[i];

    if (machine.stockLevel <= 0 || machine.stockLevel - event.getSoldQuantity() < 0) {
      let empty_stock_subscriber = new StockWarningSubscriber(machine);
      let empty_stock_event = new EmptyStockEvent(machine.stockLevel, event.machineId());
      this.pubSub.subscribe(empty_stock_event.type(), empty_stock_subscriber);
      this.pubSub.publish(empty_stock_event);
      return;
    }

    console.log("machine " + machine.id + " has " + machine.stockLevel + " before event");
    console.log(event.type() + " " + event.machineId() + " sold: " + event.getSoldQuantity());
    machine.stockLevel -= event.getSoldQuantity();
    console.log("machine " + machine.id + " has " + machine.stockLevel + " after event");

    if (machine.stockLevel < 3) {
      let stock_warning_subscriber = new StockWarningSubscriber(machine);
      let low_stock_event = new LowStockWarningEvent(machine.stockLevel, event.machineId());
      this.pubSub.subscribe(low_stock_event.type(), stock_warning_subscriber);
      this.pubSub.publish(low_stock_event);
    }
  }
}

class MachineRefillSubscriber implements ISubscriber {
  public machines: Machine[];
  public pubSub: IPublishSubscribeService;

  constructor (machines: Machine[], pubSub: IPublishSubscribeService) {
    this.machines = machines;
    this.pubSub = pubSub;
  }

  handle(event: MachineRefillEvent): void {
    let i = 0;
    while (i < this.machines.length && this.machines[i].id !== event.machineId()) i++;
    let machine = this.machines[i];

    let oldMachineStock = machine.stockLevel;
    console.log("machine " + machine.id + " has " + machine.stockLevel + " before event");
    console.log(event.type() + " " + event.machineId() + " refill: " + event.getRefillQuantity());
    machine.stockLevel += event.getRefillQuantity();
    console.log("machine " + machine.id + " has " + machine.stockLevel + " after event");

    if (oldMachineStock < 3 && oldMachineStock + event.getRefillQuantity() >= 3) {
      let stock_ok_subscriber = new StockWarningSubscriber(machine);
      let ok_stock_event = new StockLevelOkEvent(machine.stockLevel, event.machineId());
      this.pubSub.subscribe(ok_stock_event.type(), stock_ok_subscriber);
      this.pubSub.publish(ok_stock_event);
    }
  }
}

class StockWarningSubscriber implements ISubscriber {
  public machine: Machine;

  constructor (machine: Machine) {
    this.machine = machine;
  }

  handle(event: MachineRefillEvent): void {
    if (event.type() === 'Low Stock Warning') {
      console.log('Low Stock Warning on machine ' + event.machineId() );
    } else if (event.type() === 'Stock OK') {
      console.log('OK Stock on machine ' + event.machineId() );
    } else {
      console.log('No stock on machine ' + event.machineId() );
    }
  }
}


class PubSubMechanism implements IPublishSubscribeService {
  // @ts-ignore
  public hashmap: Map<string, ISubscriber[]> = new Map();

  constructor() {
  }

  publish(event: IEvent) {
    if (!this.hashmap.has(event.type())) {
      console.log("the subscriber " + event.type() + " has been unsubscribed");
      return;
    }
    this.hashmap.get(event.type())[0].handle(event);
  }

  subscribe(type: string, subscriber: ISubscriber) {
    let existingArray = this.hashmap.get(type);
    if (existingArray) {
      existingArray.push(subscriber);
    } else {
      this.hashmap.set(type, [subscriber]);
    }
  }

  unsubscribe(type: string, subscriber: ISubscriber) {
    let list: ISubscriber[] = this.hashmap.get(type);
    let filteredList: ISubscriber[] = list.filter(sub => sub !== subscriber);
    if (filteredList.length == 0) {
      this.hashmap.delete(type);
      return;
    }
    this.hashmap.set(type, filteredList);
  }

}


// objects
class Machine {
  public stockLevel = 3;
  public id: string;

  constructor (id: string) {
    this.id = id;
  }
}


// helpers
const randomMachine = (): string => {
  const random = Math.random() * 3;
  if (random < 1) {
    return '001';
  } else if (random < 2) {
    return '002';
  }
  return '003';

}

const eventGenerator = (): IEvent => {
  const random = Math.random();
  if (random < 0.5) {
    const saleQty = Math.random() < 0.5 ? 1 : 2; // 1 or 2
    return new MachineSaleEvent(saleQty, randomMachine());
  } 
  const refillQty = Math.random() < 0.5 ? 3 : 5; // 3 or 5
  return new MachineRefillEvent(refillQty, randomMachine());
}


// program
(async () => {
  // create 6 machines with a quantity of 10 stock for both refill and sale
  const machines: Machine[] = [ new Machine('001'), new Machine('002'), new Machine('003') ,
    new Machine('004'), new Machine('005'), new Machine('006')];

  // create the PubSub service
  const pubSubService: IPublishSubscribeService = new PubSubMechanism(); // implement and fix this

  // create a machine sale event subscriber. inject the machines (all subscribers should do this)
  const saleSubscriber = new MachineSaleSubscriber(machines, pubSubService);
  // create a machine refill event subscriber
  const refillSubscriber = new MachineRefillSubscriber(machines, pubSubService);

  // subscribe to sale and refill
  pubSubService.subscribe('sale', saleSubscriber);
  pubSubService.subscribe('refill', refillSubscriber);

  // create 5 random events
  const events = [1,2,3,4,5].map(i => eventGenerator());
  // for (i = 0; i<events.length; i++) {
  //   console.log(events[i].type() + events[i].machineId());
  // }

  // console.log(events[0].machineId())

  // publish the events
  events.map(event => pubSubService.publish(event));

  // test for unsubscribe
  console.log("");
  // console.log('unsubscribed from refill \n');
  // pubSubService.unsubscribe('refill', refillSubscriber);
  const events2 = [1,2,3,4,5].map(i => eventGenerator());
  // for (i = 0; i<events2.length; i++) {
  //   console.log(events2[i].type() + events2[i].machineId());
  // }
  events2.map(event => pubSubService.publish(event));

})();
