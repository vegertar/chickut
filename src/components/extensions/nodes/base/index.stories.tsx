import Extension from "./index";
import { meta, template } from "../../index.stories";

export default meta("Nodes", "Base", []);

const Template = template(Extension);

export const Example189 = Template.bind({});
Example189.args = {
  text: `A sequence of non-blank lines that cannot be interpreted as other kinds of blocks forms a paragraph. The contents of the paragraph are the result of parsing the paragraph’s raw content as inlines. The paragraph’s raw content is formed by concatenating the lines and removing initial and final whitespace.

A simple example with two paragraphs:

aaa

bbb`,
};

export const Example197 = Template.bind({});
Example197.args = {
  addon: ["Heading"],
  text: `Blank lines between block-level elements are ignored, except for the role they play in determining whether a list is tight or loose.

Blank lines at the beginning and end of the document are also ignored.
  

aaa
  

# aaa

  `,
};

export const Blank = Template.bind({});
Blank.args = {
  addon: ["Heading"],
  text: `  

aaa
  

# aaa

  `,
};
