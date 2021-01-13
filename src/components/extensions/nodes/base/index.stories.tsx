import Extension from "./index";
import { meta, template } from "../../index.stories";

export default meta("Nodes", "Base", []);

const Template = template(Extension);

export const Default = Template.bind({});
Default.args = {
  text: "Hello world",
};
