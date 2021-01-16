import { splitInfo } from "./utils";

describe("splitInfo", () => {
  it("<null>", () => {
    expect(splitInfo("")).toBeUndefined();
  });

  it("js", () => {
    expect(splitInfo("js")).toMatchObject({ lang: "js", args: "" });
  });

  it("ruby x y z", () => {
    expect(splitInfo("ruby x y z")).toMatchObject({
      lang: "ruby",
      args: "x y z",
    });
  });
});
