import Extension from "./index";
import { meta, template } from "../../index.stories";

export default meta("Nodes", Extension);

const Template = template(Extension);

export const Default = Template.bind({});
Default.args = {
  text: `<script>"counter: " + x</script>

<script>var x = 0; setInterval(() => ++x, 1000)</script>`,
};
