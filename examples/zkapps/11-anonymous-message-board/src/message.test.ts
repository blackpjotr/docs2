import { AccountUpdate, Field, Mina, Poseidon, PrivateKey, PublicKey } from 'o1js';
import { Message, users } from './message';

// Proofs are off so the suite runs in seconds. The method's assertions, the
// state transitions and the rejections are all exercised either way.
const proofsEnabled = false;

let deployer: Mina.TestPublicKey;
let zkAppKey: PrivateKey;
let zkAppAddress: PublicKey;
let zkApp: Message;

async function publish(message: Field, signer: PrivateKey) {
  const tx = await Mina.transaction(deployer, async () => {
    await zkApp.publishMessage(message, signer);
  });
  await tx.prove();
  await tx.sign([deployer.key]).send();
}

describe('Message', () => {
  beforeAll(async () => {
    const Local = await Mina.LocalBlockchain({ proofsEnabled });
    Mina.setActiveInstance(Local);

    deployer = Local.testAccounts[0];
    zkAppKey = PrivateKey.random();
    zkAppAddress = zkAppKey.toPublicKey();
    zkApp = new Message(zkAppAddress);

    if (proofsEnabled) await Message.compile();

    const tx = await Mina.transaction(deployer, async () => {
      AccountUpdate.fundNewAccount(deployer);
      await zkApp.deploy();
    });
    await tx.prove();
    await tx.sign([deployer.key, zkAppKey]).send();
  });

  it('writes the three approved posters on deployment', () => {
    expect(zkApp.user1.get().toBase58()).toBe(users.Bob.toPublicKey().toBase58());
    expect(zkApp.user2.get().toBase58()).toBe(users.SuperBob.toPublicKey().toBase58());
    expect(zkApp.user3.get().toBase58()).toBe(users.MegaBob.toPublicKey().toBase58());
  });

  it('starts with no message and an empty history', () => {
    expect(zkApp.message.get().toString()).toBe('0');
    expect(zkApp.messageHistoryHash.get().toString()).toBe('0');
  });

  // Note: `provedState` is deliberately not asserted here. It can only become
  // true once the state has been produced by proofs, and this suite runs with
  // `proofsEnabled: false` so that it finishes in seconds. What `super.init()`
  // buys is visible instead as the absence of the o1js warning about a partial
  // init, which `npm start` shows.

  it('accepts a message from an approved poster', async () => {
    await publish(Field(42), users.Bob);

    expect(zkApp.message.get().toString()).toBe('42');
  });

  it('hashes the message together with the previous hash', async () => {
    const expected = Poseidon.hash([Field(42), Field(0)]);

    expect(zkApp.messageHistoryHash.get().toString()).toBe(expected.toString());
  });

  it('accepts a message from each of the other two posters', async () => {
    await publish(Field(99), users.SuperBob);
    expect(zkApp.message.get().toString()).toBe('99');

    await publish(Field(7), users.MegaBob);
    expect(zkApp.message.get().toString()).toBe('7');
  });

  it('chains the history across every message', () => {
    const afterFirst = Poseidon.hash([Field(42), Field(0)]);
    const afterSecond = Poseidon.hash([Field(99), afterFirst]);
    const afterThird = Poseidon.hash([Field(7), afterSecond]);

    // The on-chain hash commits to the whole sequence, not just the last
    // message, so a message cannot be removed from the history unnoticed.
    expect(zkApp.messageHistoryHash.get().toString()).toBe(afterThird.toString());
  });

  it('rejects a message from a key the contract does not know', async () => {
    await expect(publish(Field(123), users.Jack)).rejects.toThrow();

    expect(zkApp.message.get().toString()).toBe('7');
  });

  it('rejects a message from a freshly generated key', async () => {
    await expect(publish(Field(123), PrivateKey.random())).rejects.toThrow();

    expect(zkApp.message.get().toString()).toBe('7');
  });
});
