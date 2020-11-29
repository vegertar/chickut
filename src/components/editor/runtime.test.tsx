import range from "lodash.range";
import Runtime from "./runtime";

const r = new Runtime();

beforeEach(() => {
  r.stack.splice(0);
});

it("declare a variable", async () => {
  await r.compile(`var x`);
  const stack = r.stack;
  expect(stack.length).toBe(2);
  expect(stack[0].name).toBe("x");
  expect(stack[1].name).toBe("___init__x");
  stack.forEach((item) => item());
  expect(r.valueOf("x")()).toBeUndefined();
});

it("declare an integer", async () => {
  await r.compile(`var x = 10`);
  const stack = r.stack;
  expect(stack.length).toBe(2);
  expect(stack[0].name).toBe("x");
  expect(stack[1].name).toBe("___init__x");
  stack.forEach((item) => item());
  expect(r.valueOf("x")()).toBe(10);
});

it("declare an array", async () => {
  await r.compile(`var x = [0, 1, 2]`);
  const stack = r.stack;
  expect(stack.length).toBe(2);
  expect(stack[0].name).toBe("x");
  expect(stack[1].name).toBe("___init__x");
  stack.forEach((item) => item());
  expect(r.valueOf("x")()).toEqual([0, 1, 2]);
});

it("declare an object", async () => {
  await r.compile(`var x = {y: 1}`);
  const stack = r.stack;
  expect(stack.length).toBe(2);
  expect(stack[0].name).toBe("x");
  expect(stack[1].name).toBe("___init__x");
  stack.forEach((item) => item());
  expect(r.valueOf("x")()).toEqual({ y: 1 });
});

it("set array elements", async () => {
  await r.compile(`
  var x = [0, 1];
  x[0] = 1;
  x[1] = 0;
  `);

  r.stack.forEach((item) => item());
  expect(r.valueOf("x")()).toEqual([1, 0]);
});

it("swap two array elements", async () => {
  await r.compile(`
  var x = [0, 1, 2];
  var i = 1;
  var tmp = x[i];
  x[i] = x[i + 1];
  x[i + 1] = tmp;
`);
  const stack = r.stack;
  stack.forEach((item) => item());
  expect(r.valueOf("tmp")()).toBe(1);
  expect(r.valueOf("x")()).toEqual([0, 2, 1]);
});

it("bubble sort", async () => {
  await r.compile(`
  var x = [0, 1, 2, 3, 4];

  var n = x.length - 1;
  var swapped = false;

  do {
    swapped = false;
    for (var i=0; i < n; i++) {
      if (x[i] < x[i+1]) {
        var temp = x[i];
        x[i] = x[i+1];
        x[i+1] = temp;
        swapped = true;
      }
    }
    n--;
  } while (swapped);
`);
  const stack = r.stack;
  stack.forEach((item) => item());
  expect(r.valueOf("x")()).toEqual([4, 3, 2, 1, 0]);
});

it("bench bubble-sort", async () => {
  await r.compile(`
  function bubbleSort(a) {
    var swapped;
    var n = a.length-1;
    var x=a;
    do {
      swapped = false;
      for (var i=0; i < n; i++) {
        if (x[i] < x[i+1]) {
          var temp = x[i];
          x[i] = x[i+1];
          x[i+1] = temp;
          swapped = true;
        }
      }
      n--;
    } while (swapped);
    return x; 
  }
  `);

  r.stack.forEach((item) => item());
  const bubbleSort = r.valueOf("bubbleSort")();
  expect(typeof bubbleSort === "function");
  expect(bubbleSort([0, 3, 1, 2])).toEqual([3, 2, 1, 0]);

  const array = range(0, 1000);
  const startTime = new Date().getTime();
  bubbleSort(array);
  const endTime = new Date().getTime();
  expect(endTime - startTime).toBeLessThan(1000);
});
