import { getRoutes, getFromRoute, Track } from "./utils";

describe("getRoutes", () => {
  const s = `
<table style="width:100%">
  <tr>
    <th>Name</th>
    <th colspan="2">Telephone</th>
  </tr>
  <tr>
    <td>Bill Gates</td>
    <td>55577854</td>
    <td>55577855</td>
  </tr>
</table>
<script>
  console.log("hello world");
</script>
`;

  const root = document.createElement("div");
  root.innerHTML = s;

  it("has no <head>", () => {
    expect(getRoutes(root, "head")).toMatchObject([]);
  });

  it("has 1 <div>", () => {
    const routes = getRoutes(root, "DIV");
    expect(routes).toMatchObject([[]]);
  });

  it("has 1 <table>", () => {
    const routes = getRoutes(root, "TABLE");
    expect(routes).toMatchObject([[1]]);
    expect(
      routes.map((route) => getFromRoute(root, route)?.nodeName)
    ).toMatchObject(["TABLE"]);
  });

  it("has 2 <tr>", () => {
    const routes = getRoutes(root, "TR");
    expect(routes).toMatchObject([
      [1, 1, 0],
      [1, 1, 2],
    ]);
    expect(
      routes.map((route) => getFromRoute(root, route)?.nodeName)
    ).toMatchObject(["TR", "TR"]);
  });

  it("has 2 <th>", () => {
    const routes = getRoutes(root, "TH");
    expect(routes).toMatchObject([
      [1, 1, 0, 1],
      [1, 1, 0, 3],
    ]);
    expect(
      routes.map((route) => getFromRoute(root, route)?.nodeName)
    ).toMatchObject(["TH", "TH"]);
  });

  it("has 3 <td>", () => {
    const routes = getRoutes(root, "TD");
    expect(
      routes.map((route) => getFromRoute(root, route)?.nodeName)
    ).toMatchObject(Array(3).fill("TD"));
  });

  it("has 1 <script>", () => {
    const routes = getRoutes(root, "SCRIPT");
    expect(
      routes.map((route) => getFromRoute(root, route)?.nodeName)
    ).toMatchObject(["SCRIPT"]);
  });
});

describe("updateDOM", () => {
  const root = document.createElement("div");
  const track = new Track("script");
  const savedRecords: Record<string, string>[] = [];

  const addScript = track.updateDOM(root, "<script>alert()</script>");
  savedRecords.push({ ...track.records });

  const insertTextBefore = track.updateDOM(root, `hello${root.innerHTML}`);
  savedRecords.push({ ...track.records });

  const insertEmptyNodeAfter = track.updateDOM(
    root,
    `${root.innerHTML}<div></div>`
  );
  savedRecords.push({ ...track.records });

  const insertEmbedScript = track.updateDOM(
    root,
    `${root.innerHTML}<div><script>console.log('ok')</script></div>`
  );
  savedRecords.push({ ...track.records });

  const modifyAndInsertEmbedScript = track.updateDOM(
    root,
    `hello<script>alert('ok')</script><div><script>console.error()</script></div><div><script>console.log('ok')</script></div>`
  );
  savedRecords.push({ ...track.records });

  const removeHeadTextAndModifyScript = track.updateDOM(
    root,
    `<script>alert()</script><div><script>console.error()</script></div><div><script>console.log('ok')</script></div>`
  );
  savedRecords.push({ ...track.records });

  const insertNestedScript = track.updateDOM(
    root,
    `<script>alert()</script><div><script>console.error()</script></div><div><div><script>console.info()</script></div><script>console.log('ok')</script></div>`
  );
  savedRecords.push({ ...track.records });

  it("add a script", () => {
    expect(addScript).toMatchObject([{ op: 1, path: "0" }]);
  });

  it("insert text before", () => {
    expect(insertTextBefore).toMatchObject([{ op: 2, path: "1" }]);
  });

  it("insert div after", () => {
    expect(insertEmptyNodeAfter).toMatchObject([]);
  });

  it("insert an embed script", () => {
    expect(insertEmbedScript).toMatchObject([{ op: 1, path: "3,0" }]);
  });

  it("modify and insert embed script respectively", () => {
    expect(modifyAndInsertEmbedScript).toMatchObject([
      { op: 0, path: "1" },
      { op: 1, path: "2,0" },
    ]);
  });

  it("remove head text and modify script", () => {
    expect(removeHeadTextAndModifyScript).toMatchObject([
      { op: 2, path: "0" },
      { op: 2, path: "1,0" },
      { op: 2, path: "2,0" },
      { op: 0, path: "0" },
    ]);
  });

  it("the scripts id are not changed", () => {
    const records = savedRecords[5];
    expect(savedRecords[0]["0"]).toBe(records["0"]);
    expect(savedRecords[3]["3,0"]).toBe(records["2,0"]);
    expect(savedRecords[4]["2,0"]).toBe(records["1,0"]);
  });

  it("insert nested script", () => {
    expect(insertNestedScript).toMatchObject([
      { op: 2, path: "2,1" },
      { op: 1, path: "2,0,0" },
    ]);
  });
});
