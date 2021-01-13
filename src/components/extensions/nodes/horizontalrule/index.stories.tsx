import Extension from "./index";
import { meta, template } from "../../index.stories";

export default meta("Nodes", "HorizontalRule");

const Template = template(Extension);

export const Default = Template.bind({});
Default.args = {
  text: `--- 
--- with other chars is not hr
without tailing spaces is not hr
---
indent 4 or more is not hr
    ---`,
};
