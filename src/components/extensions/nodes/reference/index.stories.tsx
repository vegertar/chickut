import Extension from "./index";
import { meta, template } from "../../index.stories";

export default meta("Nodes", "Reference");

const Template = template(Extension);

export const Default = Template.bind({});
Default.args = {
  text: `[foo]: /url 'title'`,
};
