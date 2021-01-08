import { trimSplit } from "./utils";

describe("trimSplit", () => {
  it("white sentence", () => {
    const s = "           ";
    expect(trimSplit(s)).toMatchObject([s, "", ""]);
  });

  it("started with white spaces", () => {
    const s = "  hello";
    expect(trimSplit(s)).toMatchObject(["  ", "hello", ""]);
  });

  it("ended with white spaces", () => {
    const s = "hello  ";
    expect(trimSplit(s)).toMatchObject(["", "hello", "  "]);
  });

  it("around with white spaces", () => {
    const s = "  hello ";
    expect(trimSplit(s)).toMatchObject(["  ", "hello", " "]);
  });
});
