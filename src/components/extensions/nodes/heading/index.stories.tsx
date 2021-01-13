import Extension from "./index";
import { meta, template } from "../../index.stories";

export default meta("Nodes", "Heading");

const Template = template(Extension);

export const Default = Template.bind({});
Default.args = {
  text: `# h1
## h2
### h3
#### h4
##### h5
###### h6
####### no h7
#without tailing spaces is not heading
   ######             still h6
    # indent 4 or more is not heading
`,
};
