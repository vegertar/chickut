import Extension from "./index";
import { meta, template } from "../../index.stories";

export default meta("Marks", "Insert");

const Template = template(Extension);

export const Default = Template.bind({});
Default.args = {
  text: `~~Strikethrough~~ ++Inserted text++ ==Marked text==

~~Strikethrough ++Inserted text ==Marked text==++~~`,
};
