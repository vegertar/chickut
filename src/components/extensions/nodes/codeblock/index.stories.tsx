import Extension from "./index";
import { meta, template } from "../../../index.stories";

export default meta("Nodes", Extension);

const Template = template(Extension);

export const Default = Template.bind({});
Default.args = {
  text: `    // Some comments
    line 1 of code
    line 2 of code
    line 3 of code

not code

    inside code
outside code`,
};
