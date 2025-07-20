"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SortBy = exports.FilterType = exports.Priority = void 0;
var Priority;
(function (Priority) {
    Priority["HIGH"] = "high";
    Priority["MEDIUM"] = "medium";
    Priority["LOW"] = "low";
})(Priority || (exports.Priority = Priority = {}));
var FilterType;
(function (FilterType) {
    FilterType["ALL"] = "all";
    FilterType["ACTIVE"] = "active";
    FilterType["COMPLETED"] = "completed";
})(FilterType || (exports.FilterType = FilterType = {}));
var SortBy;
(function (SortBy) {
    SortBy["CREATED_DATE"] = "createdDate";
    SortBy["PRIORITY"] = "priority";
    SortBy["TITLE"] = "title";
})(SortBy || (exports.SortBy = SortBy = {}));
