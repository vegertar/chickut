import Extension from "./index";
import { meta, template } from "../../index.stories";

export default meta("Marks", Extension);

const Template = template(Extension);

export const Default = Template.bind({});
Default.args = {
  text: `hello \`world\``,
};
