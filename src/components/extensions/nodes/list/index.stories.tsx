import Extension from "./index";
import { meta, template } from "../../../index.stories";

export default meta("Nodes", Extension);

const Template = template(Extension);

export const Single = Template.bind({});
Single.args = {
  text: "- the first line",
};

export const Multiple = Template.bind({});
Multiple.args = {
  text: `${Single.args.text}
- the second line
- the third line`,
};

export const Nested = Template.bind({});
Nested.args = {
  text: `+ Create a list by starting a line with +, -, or *
+ Sub-lists are made by indenting 2 spaces:
  - Marker character change forces new list start:
    * Ac tristique libero volutpat at
    + Facilisis in pretium nisl aliquet
    - Nulla volutpat aliquam velit
+ Very easy!`,
};
