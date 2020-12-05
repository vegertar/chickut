import Engine from "./engine";

const t = new Engine();

beforeEach(() => {
  // TODO
});

it("heading", async () => {
  const tokens = await t.parse("# h1");
  expect(tokens).toHaveLength(3);
});
