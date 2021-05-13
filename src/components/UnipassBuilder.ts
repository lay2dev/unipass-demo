import PWCore, {
  Address,
  Amount,
  AmountUnit,
  Cell,
  RawTransaction,
  Transaction,
  Builder,
  Collector,
  CellDep,
  DepType,
  OutPoint
} from '@lay2/pw-core';

const rsaDep = new CellDep(
  DepType.code,
  new OutPoint(
    '0xd346695aa3293a84e9f985448668e9692892c959e7e83d6d8042e59c08b8cf5c',
    '0x0'
  )
);
const acpDep = new CellDep(
  DepType.code,
  new OutPoint(
    '0x04a1ac7fe15e454741d3c5c9a409efb9a967714ad2f530870514417978a9f655',
    '0x0'
  )
);

const unipassDep = new CellDep(
  DepType.code,
  new OutPoint(
    '0x1dd7f9b7bde1ce261778abe693e739c9473b3f0c4a1a0f6f78dfec52927b6cbb',
    '0x0'
  )
);

const UnipassWitnessArgs = {
  lock: '0x' + '0'.repeat(2082),
  input_type: '',
  output_type: ''
};

export default class UnipassBuilder extends Builder {
  constructor(
    private address: Address,
    private amount: Amount,
    feeRate?: number,
    collector?: Collector
  ) {
    super(feeRate, collector);
  }

  async build(fee: Amount = Amount.ZERO): Promise<Transaction> {
    const outputCell = new Cell(this.amount, this.address.toLockScript());
    const neededAmount = this.amount.add(Builder.MIN_CHANGE).add(fee);
    let inputSum = new Amount('0');
    const inputCells: Cell[] = [];

    // fill the inputs
    const cells = await this.collector.collect(PWCore.provider.address, {
      neededAmount
    });
    for (const cell of cells) {
      inputCells.push(cell);
      inputSum = inputSum.add(cell.capacity);
      if (inputSum.gt(neededAmount)) break;
    }

    if (inputSum.lt(neededAmount)) {
      throw new Error(
        `input capacity not enough, need ${neededAmount.toString(
          AmountUnit.ckb
        )}, got ${inputSum.toString(AmountUnit.ckb)}`
      );
    }

    const changeCell = new Cell(
      inputSum.sub(outputCell.capacity),
      PWCore.provider.address.toLockScript()
    );

    const tx = new Transaction(
      new RawTransaction(
        inputCells,
        [outputCell, changeCell],
        [rsaDep, acpDep, unipassDep]
      ),
      [UnipassWitnessArgs]
    );
    this.fee = Builder.calcFee(tx, this.feeRate);
    if (changeCell.capacity.gte(Builder.MIN_CHANGE.add(this.fee))) {
      changeCell.capacity = changeCell.capacity.sub(this.fee);
      tx.raw.outputs.pop();
      tx.raw.outputs.push(changeCell);
      console.log(JSON.stringify(tx), 'rectifyTx');
      return tx;
    }
    return this.build(this.fee);
  }

  getCollector() {
    return this.collector;
  }
}
