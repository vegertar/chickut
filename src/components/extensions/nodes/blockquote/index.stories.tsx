import Extension from "./index";
import { meta, template } from "../../../index.stories";

export default meta("Nodes", Extension);

const Template = template(Extension);

export const First = Template.bind({});
First.args = {
  text: "> This is the first layer quote...",
};

export const Second = Template.bind({});
Second.args = {
  text: `${First.args.text}
>> This is the second layer quote...`,
};

export const Third = Template.bind({});
Third.args = {
  text: `${Second.args.text}
> > > This is the third layer quote...`,
};
