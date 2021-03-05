import Extension from "./index";
import { meta, template } from "../../index.stories";

export default meta("Nodes", "List");

const Template = template(Extension);

export const Example271 = Template.bind({});
Example271.args = {
  text: `Changing the bullet or ordered list delimiter starts a new list:

- foo
- bar
+ baz`,
};

export const Example272 = Template.bind({});
Example272.args = {
  text: `1. foo
2. bar
3) baz`,
};

export const Example273 = Template.bind({});
Example273.args = {
  text: `In CommonMark, a list can interrupt a paragraph. That is, no blank line is needed to separate a paragraph from a following list:

Foo
- bar
- baz`,
};

export const Example274 = Template.bind({});
Example274.args = {
  text: `In order to solve of unwanted lists in paragraphs with hard-wrapped numerals, we allow only lists starting with 1 to interrupt paragraphs. Thus,

The number of windows in my house is
14.  The number of doors is 6.`,
};

export const Example275 = Template.bind({});
Example275.args = {
  text: `We may still get an unintended result in cases like

The number of windows in my house is
1.  The number of doors is 6.`,
};

export const Example276 = Template.bind({});
Example276.args = {
  text: `There can be any number of blank lines between items:

- foo

- bar


- baz`,
};

export const Example277 = Template.bind({});
Example277.args = {
  text: `- foo
  - bar
    - baz


      bim`,
};

export const Foo = Template.bind({});
Foo.args = {
  // text: `- foo
  // - bar
  //   - baz

  //     bim
  // - xyz
  // - hhh`,
  text: `- bar
  - baz

    bim
`,
};
