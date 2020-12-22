import Extension from "./index";
import { meta, template } from "../../../index.stories";

export default meta("Nodes", Extension);

const Template = template(Extension);

export const One = Template.bind({});
One.args = {
  text: "> This is the first layer quote...",
};

export const Two = Template.bind({});
Two.args = {
  text: `${One.args.text}
>> This is the second layer quote...`,
};

export const Three = Template.bind({});
Three.args = {
  text: `${Two.args.text}
> > > This is the third layer quote...`,
};
