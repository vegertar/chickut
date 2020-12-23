import Extension from "./index";
import { meta, template } from "../../../index.stories";
import Base from "../base";

export default meta("Nodes", Extension, [Base]);

const Template = template(Extension);

export const Default = Template.bind({});
Default.args = {
  text: "Hello world",
};
