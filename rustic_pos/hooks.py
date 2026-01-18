app_name = "rustic_pos"
app_title = "Rustic POS"
app_publisher = "Rustic"
app_description = "POS customizations for ERPNext v15"
app_email = "info@rustic.com"
app_license = "MIT"

# Apps
# ------------------

required_apps = ["frappe", "erpnext"]

# Each item in the list will be shown as an app in the apps page
# add_to_apps_screen = [
# 	{
# 		"name": "rustic_pos",
# 		"logo": "/assets/rustic_pos/logo.png",
# 		"title": "Rustic POS",
# 		"route": "/rustic_pos",
# 		"has_permission": "rustic_pos.api.permission.has_app_permission"
# 	}
# ]

# Includes in <head>
# ------------------

# include js, css files in header of desk.html
# app_include_css = "/assets/rustic_pos/css/rustic_pos.css"
# app_include_js = "/assets/rustic_pos/js/rustic_pos.js"

# include js, css files in header of web template
# web_include_css = "/assets/rustic_pos/css/rustic_pos.css"
# web_include_js = "/assets/rustic_pos/js/rustic_pos.js"

# include custom scss in every website theme (without signing in)
# website_theme_scss = "rustic_pos/public/scss/website"

# include js, css files in header of web form
# webform_include_js = {"doctype": "public/js/doctype.js"}
# webform_include_css = {"doctype": "public/css/doctype.css"}

# include js in page
page_js = {
    "point-of-sale": "public/js/rustic_pos.bundle.js"
}

# include js in doctype views
# doctype_js = {"doctype" : "public/js/doctype.js"}
# doctype_list_js = {"doctype" : "public/js/doctype_list.js"}
# doctype_tree_js = {"doctype" : "public/js/doctype_tree.js"}
# doctype_calendar_js = {"doctype" : "public/js/doctype_calendar.js"}

# Svg Picker
# -----------

# svg_picker = "public/js/svg_picker.js"

# Generators
# ----------

# automatically create page for each record of doctype
# website_generators = ["Web Page"]

# Jinja
# ----------

# add methods and filters to jinja environment
# jinja = {
# 	"methods": "rustic_pos.utils.jinja_methods",
# 	"filters": "rustic_pos.utils.jinja_filters"
# }

# Installation
# ------------

# before_install = "rustic_pos.install.before_install"
# after_install = "rustic_pos.install.after_install"

# Uninstallation
# ------------

# before_uninstall = "rustic_pos.uninstall.before_uninstall"
# after_uninstall = "rustic_pos.uninstall.after_uninstall"

# Integration Setup
# ------------------
# To set up dependencies/integrations with other apps
# Name of the app being installed is passed as an argument

# before_app_install = "rustic_pos.utils.before_app_install"
# after_app_install = "rustic_pos.utils.after_app_install"

# Integration Cleanup
# -------------------
# To clean up dependencies/integrations with other apps
# Name of the app being uninstalled is passed as an argument

# before_app_uninstall = "rustic_pos.utils.before_app_uninstall"
# after_app_uninstall = "rustic_pos.utils.after_app_uninstall"

# Desk Notifications
# ------------------
# See frappe.core.notifications.get_notification_config

# notification_config = "rustic_pos.notifications.get_notification_config"

# Permissions
# -----------
# Permissions evaluated in scripted ways

# permission_query_conditions = {
# 	"Event": "frappe.desk.doctype.event.event.get_permission_query_conditions",
# }
#
# has_permission = {
# 	"Event": "frappe.desk.doctype.event.event.has_permission",
# }

# DocType Class
# ---------------
# Override standard doctype classes

# override_doctype_class = {
# 	"ToDo": "custom_app.overrides.CustomToDo"
# }

# Document Events
# ---------------
# Hook on document methods and events

# doc_events = {
# 	"*": {
# 		"on_update": "method",
# 		"on_cancel": "method",
# 		"on_trash": "method"
# 	}
# }

# Scheduled Tasks
# ---------------

# scheduler_events = {
# 	"all": [
# 		"rustic_pos.tasks.all"
# 	],
# 	"daily": [
# 		"rustic_pos.tasks.daily"
# 	],
# 	"hourly": [
# 		"rustic_pos.tasks.hourly"
# 	],
# 	"weekly": [
# 		"rustic_pos.tasks.weekly"
# 	],
# 	"monthly": [
# 		"rustic_pos.tasks.monthly"
# 	],
# }

# Testing
# -------

# before_tests = "rustic_pos.install.before_tests"

# Overriding Methods
# ------------------------------
#
# override_whitelisted_methods = {
# 	"frappe.desk.doctype.event.event.get_events": "rustic_pos.event.get_events"
# }
#
# each overriding function accepts a `data` argument;
# generated from the base implementation of the doctype dashboard,
# along with any modifications made in other Frappe apps
# override_doctype_dashboards = {
# 	"Task": "rustic_pos.task.get_dashboard_data"
# }

# exempt linked doctypes from being automatically cancelled
#
# auto_cancel_exempted_doctypes = ["Auto Repeat"]

# Ignore links to specified DocTypes when deleting documents
# -----------------------------------------------------------

# ignore_links_on_delete = ["Communication", "ToDo"]

# Request Events
# ----------------
# before_request = ["rustic_pos.utils.before_request"]
# after_request = ["rustic_pos.utils.after_request"]

# Job Events
# ----------
# before_job = ["rustic_pos.utils.before_job"]
# after_job = ["rustic_pos.utils.after_job"]

# User Data Protection
# --------------------

# user_data_fields = [
# 	{
# 		"doctype": "{doctype_1}",
# 		"filter_by": "{filter_by}",
# 		"redact_fields": ["{field_1}", "{field_2}"],
# 		"partial": 1,
# 	},
# 	{
# 		"doctype": "{doctype_2}",
# 		"filter_by": "{filter_by}",
# 		"partial": 1,
# 	},
# 	{
# 		"doctype": "{doctype_3}",
# 		"strict": False,
# 	},
# 	{
# 		"doctype": "{doctype_4}"
# 	}
# ]

# Authentication and authorization
# --------------------------------

# auth_hooks = [
# 	"rustic_pos.auth.validate"
# ]

# Fixtures
# --------
fixtures = [
    {
        "doctype": "Custom Field",
        "filters": [
            ["dt", "=", "POS Profile"],
            ["fieldname", "in", [
                "rustic_pos_section",
                "rustic_allow_discount_change",
                "rustic_allow_uom_change",
                "rustic_item_view_mode",
                "rustic_hide_loyalty",
                "rustic_hide_item_group"
            ]]
        ]
    }
]
