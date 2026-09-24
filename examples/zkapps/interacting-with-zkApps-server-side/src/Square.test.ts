import { AccountUpdate, Field, Mina, PrivateKey, PublicKey } from 'o1js';
import { Square } from './Square';

// Proofs are off so the suite runs in seconds. The method's assertions, the
// state transitions and the rejection are all exercised either way.
const proofsEnabled = false;

let deployer: Mina.TestPublicKey;
let zkAppKey: PrivateKey;
let zkAppAddress: PublicKey;
let zkApp: Square;

async function deployToItsOwnKey() {
  const tx = await Mina.transaction(deployer, async () => {
    AccountUpdate.fundNewAccount(deployer);
    await zkApp.deploy();
  });
  await tx.prove();
  await tx.sign([deployer.key, zkAppKey]).send();
}

async function update(square: Field) {
  const tx = await Mina.transaction(deployer, async () => {
    await zkApp.update(square);
  });
  await tx.prove();
  await tx.sign([deployer.key]).send();
}

describe('Square, driven server-side', () => {
  beforeEach(async () => {
    const Local = await Mina.LocalBlockchain({ proofsEnabled });
    Mina.setActiveInstance(Local);

    deployer = Local.testAccounts[0];
    zkAppKey = PrivateKey.random();
    zkAppAddress = zkAppKey.toPublicKey();
    zkApp = new Square(zkAppAddress);

    if (proofsEnabled) await Square.compile();
  });

  it('deploys the zkApp to a key that is not the fee payer', async () => {
    await deployToItsOwnKey();

    // The whole reason this tutorial deploys programmatically rather than
    // with `zk deploy`: the contract does not live at the fee payer's
    // address.
    expect(zkAppAddress.toBase58()).not.toBe(deployer.toBase58());
    expect(Mina.getAccount(zkAppAddress).zkapp).toBeDefined();
  });

  it('runs init() on the first deploy, setting num to 3', async () => {
    await deployToItsOwnKey();
    expect(zkApp.num.get()).toEqual(Field(3));
  });

  it('charges the fee payer for the new zkApp account', async () => {
    const before = Mina.getBalance(deployer);
    await deployToItsOwnKey();
    const after = Mina.getBalance(deployer);

    // `AccountUpdate.fundNewAccount` is what pays this. Without that line the
    // deploy fails, which is easy to miss when the deployer is also the
    // zkApp.
    expect(after.toBigInt()).toBeLessThan(before.toBigInt());
  });

  it('updates num to its square, the flow main.ts drives', async () => {
    await deployToItsOwnKey();

    const num = zkApp.num.get();
    await update(num.mul(num));

    expect(zkApp.num.get()).toEqual(Field(9));
  });

  it('rejects an update that is not the square of the current state', async () => {
    await deployToItsOwnKey();

    await expect(update(Field(4))).rejects.toThrow(/4.*9/);
  });

  it('leaves the state untouched when an update is rejected', async () => {
    await deployToItsOwnKey();
    await expect(update(Field(4))).rejects.toThrow();

    expect(zkApp.num.get()).toEqual(Field(3));
  });

  it('chains squares across successive transactions', async () => {
    await deployToItsOwnKey();

    // 3 -> 9 -> 81. A script that drives a contract over several
    // transactions has to re-read the state between them, which is the part
    // main.ts does with `zkapp.num.fetch()` against a live node.
    await update(zkApp.num.get().mul(zkApp.num.get()));
    await update(zkApp.num.get().mul(zkApp.num.get()));

    expect(zkApp.num.get()).toEqual(Field(81));
  });
});
