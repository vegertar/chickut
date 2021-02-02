import Extension from "./index";
import { meta, template } from "../../index.stories";

export default meta("Nodes", "Blockquote");

const Template = template(Extension);

export const Default = Template.bind({});
Default.args = {
  text: `> Blockquotes can also be nested...
  >> ...by using additional greater-than signs right next to each other...
  > > > ...or with spaces between arrows.
`,
};
