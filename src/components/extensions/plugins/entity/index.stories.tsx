import Extension from "./index";
import { meta, template } from "../../index.stories";

export default meta("Plugins", "Entity");

const Template = template(Extension);

export const Default = Template.bind({});
Default.args = {
  text: `&nbsp; &amp; &copy; &AElig; &Dcaron;
&frac34; &HilbertSpace; &DifferentialD;
&ClockwiseContourIntegral; &ngE;`,
};
