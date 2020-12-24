import Extension from "./index";
import { meta, template } from "../../../index.stories";

export default meta("Nodes", Extension);

const Template = template(Extension);

export const Default = Template.bind({});
Default.args = {
  text: `> 1st layer quote...
inside 1st

outside 1st  
>> 2nd layer quote...
> inside 2nd
inside 2nd too

outside 2nd  
> > > 3rd quote...
>> inside 3rd
> inside 3rd too
inside 3rd as well

outside 3rd
>>> still 3rd quote...

    > indent 4 or more is not quote
>without tailing spaces is not quote
`,
};
