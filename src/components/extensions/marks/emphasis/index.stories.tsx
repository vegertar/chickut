import Extension from "./index";
import { meta, template } from "../../index.stories";

export default meta("Marks", "Emphasis");

const Template = template(Extension);

export const Default = Template.bind({});
Default.args = {
  text: `**This is bold text**

__This is bold text__

*This is italic text*

_This is italic text_

***This is bold italic text***

___This is bold italic text___

**_This is bold italic text_**

_**This is bold italic text**_

__*This is bold italic text*__
`,
};
