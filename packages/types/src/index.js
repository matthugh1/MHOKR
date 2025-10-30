"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.IntegrationSource = exports.AIPersona = exports.ActivityAction = exports.EntityType = exports.InitiativeStatus = exports.MetricType = exports.OKRStatus = exports.Period = exports.MemberRole = void 0;
var MemberRole;
(function (MemberRole) {
    MemberRole["ORG_ADMIN"] = "ORG_ADMIN";
    MemberRole["WORKSPACE_OWNER"] = "WORKSPACE_OWNER";
    MemberRole["TEAM_LEAD"] = "TEAM_LEAD";
    MemberRole["MEMBER"] = "MEMBER";
    MemberRole["VIEWER"] = "VIEWER";
})(MemberRole || (exports.MemberRole = MemberRole = {}));
var Period;
(function (Period) {
    Period["QUARTERLY"] = "QUARTERLY";
    Period["ANNUAL"] = "ANNUAL";
    Period["CUSTOM"] = "CUSTOM";
})(Period || (exports.Period = Period = {}));
var OKRStatus;
(function (OKRStatus) {
    OKRStatus["ON_TRACK"] = "ON_TRACK";
    OKRStatus["AT_RISK"] = "AT_RISK";
    OKRStatus["OFF_TRACK"] = "OFF_TRACK";
    OKRStatus["COMPLETED"] = "COMPLETED";
    OKRStatus["CANCELLED"] = "CANCELLED";
})(OKRStatus || (exports.OKRStatus = OKRStatus = {}));
var MetricType;
(function (MetricType) {
    MetricType["INCREASE"] = "INCREASE";
    MetricType["DECREASE"] = "DECREASE";
    MetricType["REACH"] = "REACH";
    MetricType["MAINTAIN"] = "MAINTAIN";
})(MetricType || (exports.MetricType = MetricType = {}));
var InitiativeStatus;
(function (InitiativeStatus) {
    InitiativeStatus["NOT_STARTED"] = "NOT_STARTED";
    InitiativeStatus["IN_PROGRESS"] = "IN_PROGRESS";
    InitiativeStatus["COMPLETED"] = "COMPLETED";
    InitiativeStatus["BLOCKED"] = "BLOCKED";
})(InitiativeStatus || (exports.InitiativeStatus = InitiativeStatus = {}));
var EntityType;
(function (EntityType) {
    EntityType["OBJECTIVE"] = "OBJECTIVE";
    EntityType["KEY_RESULT"] = "KEY_RESULT";
    EntityType["INITIATIVE"] = "INITIATIVE";
    EntityType["CHECK_IN"] = "CHECK_IN";
})(EntityType || (exports.EntityType = EntityType = {}));
var ActivityAction;
(function (ActivityAction) {
    ActivityAction["CREATED"] = "CREATED";
    ActivityAction["UPDATED"] = "UPDATED";
    ActivityAction["DELETED"] = "DELETED";
    ActivityAction["COMPLETED"] = "COMPLETED";
    ActivityAction["ALIGNED"] = "ALIGNED";
    ActivityAction["COMMENTED"] = "COMMENTED";
})(ActivityAction || (exports.ActivityAction = ActivityAction = {}));
var AIPersona;
(function (AIPersona) {
    AIPersona["OKR_COACH"] = "OKR_COACH";
    AIPersona["CASCADE_ASSISTANT"] = "CASCADE_ASSISTANT";
    AIPersona["PROGRESS_ANALYST"] = "PROGRESS_ANALYST";
})(AIPersona || (exports.AIPersona = AIPersona = {}));
var IntegrationSource;
(function (IntegrationSource) {
    IntegrationSource["JIRA"] = "JIRA";
    IntegrationSource["GITHUB"] = "GITHUB";
    IntegrationSource["SALESFORCE"] = "SALESFORCE";
    IntegrationSource["CUSTOM_WEBHOOK"] = "CUSTOM_WEBHOOK";
})(IntegrationSource || (exports.IntegrationSource = IntegrationSource = {}));
//# sourceMappingURL=index.js.map