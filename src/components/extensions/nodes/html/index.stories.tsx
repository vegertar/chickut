import Extension from "./index";
import { meta, template } from "../../index.stories";

export default meta("Nodes", "Html");

const Template = template(Extension);

export const Default = Template.bind({});
Default.args = {
  text: `<i>hello</i> <button onclick="alert('html')">click</button>`,
};
