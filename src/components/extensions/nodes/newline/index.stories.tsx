import Extension from "./index";
import { meta, template } from "../../index.stories";

export default meta("Nodes", "Newline");

const Template = template(Extension);

export const Default = Template.bind({});
Default.args = {
  text: `hello  
world

hello
world`,
};
