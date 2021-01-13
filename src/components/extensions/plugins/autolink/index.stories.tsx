import Extension from "./index";
import { meta, template } from "../../index.stories";

export default meta("Plugins", "Autolink", ["Base", "Link"]);

const Template = template(Extension);

export const Default = Template.bind({});
Default.args = {
  text: `<http://foo.bar.baz>`,
};
