import Extension from "./index";
import { meta, template } from "../../index.stories";

export default meta("Marks", Extension);

const Template = template(Extension);

export const Default = Template.bind({});
Default.args = {
  text: `haha, ***hello** world*, ooo*o**o ****o**** **x* y*

haha, ***hello**** world*, ooo*o**o **o** *x y*`,
};
