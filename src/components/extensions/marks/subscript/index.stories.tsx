import Extension from "./index";
import { meta, template } from "../../index.stories";

export default meta("Marks", "Subscript");

const Template = template(Extension);

export const Default = Template.bind({});
Default.args = {
  text: `H~2~O 19^th^`,
};
