import Text from "./text";

const t = new Text();

beforeEach(() => {
  // TODO
});

it("heading", async () => {
  const tokens = await t.parse("# h1");
  expect(tokens).toHaveLength(3);
});
